import { Component, NgZone, OnDestroy } from '@angular/core'
import { ConfigService, HotkeyDescription, HotkeysService, HostAppService } from 'tabby-core'
import { Subscription } from 'rxjs'

@Component({
    template: `
        <div class="enhanced-hotkeys-settings">
            <h3 class="mb-4">{{ "Hotkey Finder" | translate }}</h3>
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
                        <div>
                            <strong>{{ hotkey.name }}</strong>
                            <div class="text-muted small">{{ hotkey.id }}</div>
                        </div>
                        <div class="d-flex flex-wrap justify-content-end">
                            <div
                                class="badge badge-info ml-1 p-1"
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
        .enhanced-hotkeys-settings {
            /* padding: 20px; */
        }
        .ml-2 {
            margin-left: 0.5rem;
        }
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
    private keystrokeSubscription: Subscription | null = null

    constructor (
        public config: ConfigService,
        public hostApp: HostAppService,
        private zone: NgZone,
        private hotkeys: HotkeysService,
    ) {
        this.hotkeys.getHotkeyDescriptions().then(descriptions => {
            this.hotkeyDescriptions = descriptions
            this.updateFilters()
        })
    }

    ngOnDestroy () {
        this.stopCapturing()
    }

    private getStrokesArray (id: string): string[][] {
        // 1. Get custom hotkeys from config
        let custom: any = this.config.store.hotkeys
        for (const token of id.split(/\./g)) {
            custom = custom?.[token]
        }
        
        // 2. Get default hotkeys from descriptions
        const desc = this.hotkeyDescriptions.find(x => x.id === id)
        const defaults = desc?.default || []

        // Combine them (custom overrides default in Tabby, but here we show all possible bindings)
        const combined = (custom || defaults) as (string | string[])[]
        return combined.map(x => typeof x === 'string' ? [x] : x)
    }

    updateFilters () {
        const filterLower = this.hotkeyFilter.toLowerCase().trim()
        
        let results = this.hotkeyDescriptions.map(h => {
            const strokesArray = this.getStrokesArray(h.id)
            return {
                ...h,
                strokesArray,
                strokesStr: strokesArray.map(s => s.join(' ')).join(', '),
            }
        })

        if (this.capturedKeystroke) {
            const captureLower = this.capturedKeystroke.toLowerCase()
            results = results.filter(h => {
                return h.strokesArray.some(s => s.some(k => k.toLowerCase() === captureLower))
            })
        }

        if (filterLower) {
            results = results.filter(h => {
                if (h.name.toLowerCase().includes(filterLower)) return true
                if (h.id.toLowerCase().includes(filterLower)) return true
                if (h.strokesStr.toLowerCase().includes(filterLower)) return true
                return false
            })
            
            results.sort((a, b) => {
                const aName = a.name.toLowerCase()
                const bName = b.name.toLowerCase()
                if (aName.startsWith(filterLower) && !bName.startsWith(filterLower)) return -1
                if (!aName.startsWith(filterLower) && bName.startsWith(filterLower)) return 1
                return aName.localeCompare(bName)
            })
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
