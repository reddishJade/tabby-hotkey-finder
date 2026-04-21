import { Component, NgZone, OnDestroy } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, HotkeyDescription, HotkeysService, HostAppService, Hotkey } from 'tabby-core'
import { HotkeyInputModalComponent } from 'tabby-settings'
import { Subscription } from 'rxjs'

@Component({
    template: `
        <div class="enhanced-hotkeys-settings">
            <div class="d-flex align-items-center mb-4">
                <h3 class="m-0">{{ "Hotkey Finder" | translate }}</h3>
                <div class="ml-4" *ngIf="conflictsCount > 0">
                    <span class="badge badge-conflict-header">
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

            <div class="list-group list-group-flush mt-4">
                <div
                    class="list-group-item px-0"
                    *ngFor="let hotkey of filteredHotkeys"
                >
                    <div class="row align-items-center">
                        <div class="col-7">
                            <div class="d-flex align-items-center">
                                <strong>{{ hotkey.name | translate }}</strong>
                                <span class="badge-conflict-tag ml-2" *ngIf="hotkey.hasConflict">
                                    {{ "Conflict" | translate }}
                                </span>
                            </div>
                            <div class="text-muted small">{{ hotkey.id }}</div>
                        </div>
                        <div class="col-5 d-flex flex-wrap justify-content-end align-items-center hotkey-column">
                            <!-- Existing Strokes -->
                            <div
                                class="hotkey-item mb-1 ml-1"
                                *ngFor="let strokes of hotkey.strokesArray; let i = index"
                            >
                                <div class="hotkey-body" (click)="editHotkey(hotkey, i)">
                                    <span 
                                        class="hotkey-stroke" 
                                        [class.conflict]="isStrokeConflicting(strokes)"
                                    >{{ strokes.join(" ") }}</span>
                                </div>
                                <div class="hotkey-remove" (click)="removeHotkey(hotkey, i)">&times;</div>
                            </div>
                            
                            <!-- Add Button -->
                            <button class="btn btn-link btn-sm add-hotkey-btn ml-1 mb-1" (click)="addHotkey(hotkey)">
                                <i class="fas fa-plus mr-1"></i>
                                {{ "Add..." | translate }}
                            </button>
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
        .ml-4 { margin-left: 1.5rem !important; }
        .mr-1 { margin-right: 0.25rem; }
        
        .list-group-item {
            background: transparent !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
            padding: 12px 0 !important;
        }

        .badge-conflict-header {
            background-color: rgba(255, 68, 68, 0.2);
            color: #ff4444;
            border: 1px solid #ff4444;
            padding: 5px 10px;
        }

        .badge-conflict-tag {
            background-color: #ff4444;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: bold;
            text-transform: uppercase;
        }

        /* Replicating Tabby's native hotkey input styles */
        .hotkey-item {
            display: flex;
            align-items: stretch;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
        }

        .hotkey-body {
            padding: 2px 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
        }

        .hotkey-body:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .hotkey-stroke {
            font-family: monospace;
            font-size: 0.9rem;
            color: #ccc;
        }

        .hotkey-stroke.conflict {
            color: #ff4444;
            font-weight: bold;
        }

        .hotkey-remove {
            padding: 2px 6px;
            cursor: pointer;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            color: #888;
            display: flex;
            align-items: center;
            line-height: 1;
        }

        .hotkey-remove:hover {
            background: rgba(255, 68, 68, 0.2);
            color: #ff4444;
        }

        .add-hotkey-btn {
            color: #888;
            text-decoration: none;
            font-size: 0.8rem;
            padding: 2px 8px;
        }

        .add-hotkey-btn:hover {
            color: #ccc;
            background: rgba(255, 255, 255, 0.05);
        }

        .hotkey-column {
            min-height: 40px;
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
        private ngbModal: NgbModal,
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
            const hasConflict = strokesArray.some(s => this.isStrokeConflicting(s))

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
            results.sort((a, b) => (a.hasConflict === b.hasConflict) ? 0 : a.hasConflict ? -1 : 1)
        }

        this.filteredHotkeys = results
    }

    isStrokeConflicting (strokes: string[]): boolean {
        const sStr = strokes.join(' ').toLowerCase()
        return (this.strokeToIdsMap.get(sStr)?.length || 0) > 1
    }

    async addHotkey (hotkey: any) {
        const result = await this.ngbModal.open(HotkeyInputModalComponent).result
        if (result) {
            const current = this.getStrokesArray(hotkey.id)
            current.push(result)
            this.setHotkeys(hotkey.id, current)
        }
    }

    async editHotkey (hotkey: any, index: number) {
        const result = await this.ngbModal.open(HotkeyInputModalComponent).result
        if (result) {
            const current = this.getStrokesArray(hotkey.id)
            current[index] = result
            this.setHotkeys(hotkey.id, current)
        }
    }

    removeHotkey (hotkey: any, index: number) {
        const current = this.getStrokesArray(hotkey.id)
        current.splice(index, 1)
        this.setHotkeys(hotkey.id, current)
    }

    private setHotkeys (id: string, strokes: string[][]) {
        let ptr = this.config.store
        let prop = 'hotkeys'
        const path = id.split(/\./g)
        
        for (const token of path) {
            if (!ptr[prop]) {
                ptr[prop] = {}
            }
            ptr = ptr[prop]
            prop = token
        }
        
        // Normalize back to Tabby's format (strings for single strokes)
        ptr[prop] = strokes.map(s => s.length === 1 ? s[0] : s)
        
        this.config.save()
        this.calculateConflicts()
        this.updateFilters()
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
