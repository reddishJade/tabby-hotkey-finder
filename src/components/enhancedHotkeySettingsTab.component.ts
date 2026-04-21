import { Component, NgZone, OnDestroy } from '@angular/core'
import { ConfigService, HotkeyDescription, HotkeysService, HostAppService } from 'tabby-core'
import { Subscription } from 'rxjs'

// Using require for fuzzy-search to avoid type definition issues during transpile
const FuzzySearch = require('fuzzy-search')

@Component({
    template: `
        <div class="enhanced-hotkeys-settings">
            <h3 class="mb-4">{{ "Hotkey Finder" | translate }}</h3>
            <div class="input-group mb-3">
                <input
                    type="text"
                    class="form-control"
                    [placeholder]="'Search hotkeys' | translate"
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
                        *ngIf="capturedKeystroke"
                        (click)="clearCapturing()"
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
                                *ngFor="let strokes of getStrokesArray(hotkey.id)"
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
            background: transparent;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
    `]
})
export class EnhancedHotkeySettingsTabComponent implements OnDestroy {
    hotkeyFilter = ''
    hotkeyDescriptions: HotkeyDescription[] = []
    filteredHotkeys: (HotkeyDescription & { strokesStr: string })[] = []
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

    getStrokesArray (id: string): string[][] {
        let ptr = this.config.store.hotkeys
        for (const token of id.split(/\./g)) {
            ptr = ptr?.[token]
        }
        if (!ptr) {
            return []
        }
        return (ptr as (string | string[])[]).map(x => typeof x === 'string' ? [x] : x)
    }

    updateFilters () {
        const filterLower = this.hotkeyFilter.toLowerCase()
        let results = this.hotkeyDescriptions.map(h => {
            const strokesArray = this.getStrokesArray(h.id)
            return {
                ...h,
                strokesArray,
                strokesStr: strokesArray.map(s => s.join(' ')).join(', '),
            }
        })

        if (this.capturedKeystroke) {
            results = results.filter(h => {
                return h.strokesArray.some(s => s.some(k => k.toLowerCase() === this.capturedKeystroke!.toLowerCase()))
            })
        }

        if (this.hotkeyFilter) {
            // Standard fuzzy search on name and id
            const searcher = new FuzzySearch(results, ['name', 'id', 'strokesStr'], {
                caseSensitive: false,
                sort: true,
            })
            results = searcher.search(this.hotkeyFilter)
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

    clearCapturing () {
        this.capturedKeystroke = null
        this.updateFilters()
    }
}
