import { Component, NgZone, OnDestroy } from '@angular/core'
import { ConfigService, HotkeyDescription, HotkeysService, HostAppService } from 'tabby-core'
import { Subscription } from 'rxjs'

@Component({
    template: `
        <div class="enhanced-hotkeys-settings">
            <div class="d-flex align-items-center mb-4">
                <h3 class="m-0">{{ "Hotkey Finder" | translate }}</h3>
                <div class="ml-auto" *ngIf="conflictsCount > 0">
                    <span class="badge badge-danger">
                        <i class="fas fa-exclamation-triangle mr-1"></i>
                        {{ conflictsCount }} {{ "Conflicts Detected" | translate }}
                    </span>
                </div>
            </div>

            <div class="input-group mb-3">
                <input
                    type="text"
                    class="form-control"
                    [placeholder]="'Search hotkeys (e.g. Ctrl, Alt, or name)' | translate"
                    [(ngModel)]="hotkeyFilter"
                    (ngModelChange)="updateFilters()"
                >
                <div class="input-group-append">
                    <button
                        class="btn btn-secondary"
                        (click)="isCapturing ? stopCapturing() : startCapturing()"
                        [class.active]="isCapturing"
                    >
                        <i class="fas fa-keyboard"></i>
                        <span class="ml-2">{{ (isCapturing ? "Capturing..." : capturedKeystroke || "Press key to find") | translate }}</span>
                    </button>
                    <button
                        class="btn btn-outline-secondary"
                        *ngIf="capturedKeystroke || hotkeyFilter"
                        (click)="clearAll()"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="list-group list-group-flush">
                <div
                    class="list-group-item px-0"
                    *ngFor="let hotkey of filteredHotkeys"
                >
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div class="mr-3">
                            <div class="d-flex align-items-center">
                                <strong>{{ hotkey.name }}</strong>
                                <span class="badge badge-danger ml-2" *ngIf="hotkey.hasConflict">
                                    {{ "Conflict" | translate }}
                                </span>
                            </div>
                            <div class="text-muted small">{{ hotkey.id }}</div>
                        </div>
                        <div class="d-flex flex-wrap justify-content-end">
                            <div
                                class="badge ml-1 p-1"
                                [class.badge-info]="!hotkey.hasConflict"
                                [class.badge-danger]="hotkey.hasConflict"
                                *ngFor="let strokes of hotkey.strokesArray"
                            >
                                {{ strokes.join(" ") }}
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    class="list-group-item text-center text-muted py-5"
                    *ngIf="filteredHotkeys.length === 0"
                >
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <p>{{ "No hotkeys found" | translate }}</p>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .ml-2 { margin-left: 0.5rem; }
        .mr-1 { margin-right: 0.25rem; }
        .list-group-item {
            background: transparent !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
        }
    `]
})
export class EnhancedHotkeySettingsTabComponent implements OnDestroy {
    hotkeyFilter = ''
    hotkeyDescriptions: HotkeyDescription[] = []
    filteredHotkeys: any[] = []
    isCapturing = false
    capturedKeystroke: string | null = null
    conflictsCount = 0
    private keystrokeSubscription: Subscription | null = null
    private strokeToIdsMap = new Map<string, string[]>()

    constructor (
        public config: ConfigService,
        public hostApp: HostAppService,
        private zone: NgZone,
        private hotkeys: HotkeysService,
    ) {
        this.hotkeys.getHotkeyDescriptions().then(descriptions => {
            this.hotkeyDescriptions = descriptions
            this.calculateConflicts()
            this.updateFilters()
        })
    }

    ngOnDestroy () {
        this.stopCapturing()
    }

    private getStrokesArray (id: string): string[][] {
        let ptr = this.config.store.hotkeys
        for (const token of id.split(/\./g)) {
            ptr = ptr?.[token]
        }
        if (!ptr) {
            ptr = (this.config as any).defaults?.hotkeys
            if (ptr) {
                for (const token of id.split(/\./g)) {
                    ptr = ptr?.[token]
                }
            }
        }
        if (!ptr) return []
        let rawArray: any[] = []
        if (typeof ptr === 'string') {
            rawArray = [[ptr]]
        } else if (Array.isArray(ptr)) {
            rawArray = ptr.map(x => typeof x === 'string' ? [x] : x)
        }
        return rawArray
    }

    private calculateConflicts () {
        this.strokeToIdsMap.clear()
        this.conflictsCount = 0
        const conflictIds = new Set<string>()

        for (const h of this.hotkeyDescriptions) {
            const strokes = this.getStrokesArray(h.id)
            for (const s of strokes) {
                const sStr = s.join(' ').toLowerCase()
                if (!this.strokeToIdsMap.has(sStr)) {
                    this.strokeToIdsMap.set(sStr, [])
                }
                this.strokeToIdsMap.get(sStr)!.push(h.id)
            }
        }

        // Count unique hotkey IDs that are part of any conflict
        for (const [stroke, ids] of this.strokeToIdsMap.entries()) {
            if (ids.length > 1) {
                ids.forEach(id => conflictIds.add(id))
            }
        }
        this.conflictsCount = conflictIds.size
    }

    updateFilters () {
        const filterLower = this.hotkeyFilter.toLowerCase().trim()
        
        let results = this.hotkeyDescriptions.map(h => {
            const strokesArray = this.getStrokesArray(h.id)
            const hasConflict = strokesArray.some(s => {
                const sStr = s.join(' ').toLowerCase()
                return (this.strokeToIdsMap.get(sStr)?.length || 0) > 1
            })

            return {
                ...h,
                strokesArray,
                strokesStr: strokesArray.map(s => s.join(' ')).join(', '),
                hasConflict
            }
        })

        if (this.capturedKeystroke) {
            const captureLower = this.capturedKeystroke.toLowerCase()
            results = results.filter(h => h.strokesStr.toLowerCase().includes(captureLower))
        }

        if (filterLower) {
            results = results.filter(h => {
                if (h.name.toLowerCase().includes(filterLower)) return true
                if (h.id.toLowerCase().includes(filterLower)) return true
                if (h.strokesStr.toLowerCase().includes(filterLower)) return true
                return false
            })
            
            results.sort((a, b) => {
                if (a.hasConflict && !b.hasConflict) return -1
                if (!a.hasConflict && b.hasConflict) return 1
                const aName = a.name.toLowerCase()
                const bName = b.name.toLowerCase()
                if (aName.startsWith(filterLower) && !bName.startsWith(filterLower)) return -1
                if (!aName.startsWith(filterLower) && bName.startsWith(filterLower)) return 1
                return aName.localeCompare(bName)
            })
        } else {
            // Sort by conflict first if no filter
            results.sort((a, b) => (a.hasConflict === b.hasConflict) ? 0 : a.hasConflict ? -1 : 1)
        }

        this.filteredHotkeys = results
    }

    startCapturing () {
        this.isCapturing = true
        this.capturedKeystroke = null
        this.hotkeys.disable()
        this.keystrokeSubscription = this.hotkeys.keystroke$.subscribe(keystroke => {
            this.zone.run(() => {
                this.capturedKeystroke = keystroke
                this.updateFilters()
                this.stopCapturing()
            })
        })
    }

    stopCapturing () {
        this.isCapturing = false
        if (this.keystrokeSubscription) {
            this.keystrokeSubscription.unsubscribe()
            this.keystrokeSubscription = null
            this.hotkeys.enable()
        }
    }

    clearAll () {
        this.capturedKeystroke = null
        this.hotkeyFilter = ''
        this.updateFilters()
    }
}
