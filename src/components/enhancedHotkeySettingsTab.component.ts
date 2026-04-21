import { Component, NgZone, OnDestroy } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, HotkeyDescription, HotkeysService, HostAppService } from 'tabby-core'
import { Subscription } from 'rxjs'
import { LocalHotkeyInputModalComponent } from './hotkeyInputModal.component'

@Component({
    template: `
        <div class="content-box">
            <div class="row align-items-center mb-3">
                <div class="col-8">
                    <h3 class="m-0">{{ "Hotkey Finder" | translate }}</h3>
                </div>
                <div class="col-4 pe-5 text-start" *ngIf="conflictsCount > 0">
                    <span class="badge badge-conflict-header">
                        <i class="fas fa-exclamation-triangle me-1"></i>
                        {{ conflictsCount }} {{ "Conflicts" | translate }}
                    </span>
                </div>
            </div>

            <div class="row mb-4 align-items-center">
                <div class="col-8">
                    <div class="input-group">
                        <div class="input-group-text">
                            <i class="fas fa-fw fa-search"></i>
                        </div>
                        <input
                            type="search"
                            class="form-control"
                            [placeholder]="'Search hotkeys' | translate"
                            [(ngModel)]="hotkeyFilter"
                            (ngModelChange)="updateFilters()"
                        >
                    </div>
                </div>
                <div class="col-4 pe-5">
                    <div class="capture-controls">
                        <button
                            class="btn btn-secondary capture-btn"
                            (click)="isCapturing ? stopCapturing() : startCapturing()"
                            [class.active]="isCapturing"
                        >
                            <i class="fas fa-keyboard"></i>
                            <span class="capture-label">{{ (isCapturing ? "Capturing..." : capturedKeystroke || "Press key to find") | translate }}</span>
                        </button>
                        <button
                            class="btn btn-outline-secondary clear-btn"
                            *ngIf="capturedKeystroke || hotkeyFilter"
                            (click)="clearAll()"
                        >
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="hotkeys-table mb-3">
                <div
                    class="row align-items-center hotkey-row"
                    *ngFor="let hotkey of filteredHotkeys"
                >
                    <div class="col-8 py-2">
                        <span>{{ hotkey.name | translate }}</span>
                        <span class="ms-2 text-muted">({{ hotkey.id }})</span>
                        <span class="badge-conflict-tag ms-2" *ngIf="hotkey.hasConflict">
                            {{ "Conflict" | translate }}
                        </span>
                    </div>
                    <div class="col-4 pe-5">
                        <div class="multi-hotkey-input">
                            <div
                                class="item"
                                [class.conflict-item]="isStrokeConflicting(strokes)"
                                *ngFor="let strokes of hotkey.strokesArray; let i = index"
                            >
                                <div class="body" (click)="editHotkey(hotkey, i)">
                                    <div class="stroke" *ngFor="let stroke of strokes">
                                        <span [class.duplicate]="isStrokeConflicting(strokes)">{{ stroke }}</span>
                                    </div>
                                </div>
                                <div class="remove" (click)="removeHotkey(hotkey, i)">&times;</div>
                            </div>

                            <div class="add" (click)="addHotkey(hotkey)">{{ "Add..." | translate }}</div>
                        </div>
                    </div>
                </div>

                <div
                    class="text-center text-muted py-5"
                    *ngIf="filteredHotkeys.length === 0"
                >
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <p>{{ "No hotkeys found" | translate }}</p>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .content-box {
            max-width: 600px;
        }

        .hotkey-row {
            margin: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .badge-conflict-header {
            background-color: rgba(255, 68, 68, 0.1);
            color: #ff4444;
            border: 1px solid rgba(255, 68, 68, 0.3);
            font-weight: normal;
            vertical-align: middle;
        }

        .badge-conflict-tag {
            color: #ff4444;
            font-size: 0.7rem;
            font-weight: bold;
            text-transform: uppercase;
            border: 1px solid #ff4444;
            padding: 1px 4px;
            border-radius: 3px;
        }

        .capture-controls {
            display: flex;
            align-items: stretch;
            width: 100%;
        }

        .capture-btn {
            min-width: 0;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 0.5rem;
        }

        .capture-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .clear-btn {
            margin-left: 0.375rem;
            flex: none;
        }

        .multi-hotkey-input {
            display: flex;
            flex-wrap: nowrap;
            align-items: stretch;
            white-space: nowrap;
        }

        .multi-hotkey-input:hover .add {
            display: initial;
        }

        .item {
            display: flex;
            flex: none;
            background: var(--theme-bg-more);
            border: 1px solid var(--bs-primary);
            border-radius: 3px;
            margin-right: 5px;
        }

        .item .body {
            flex: none;
            display: flex;
            padding: 3px 0 2px;
            cursor: pointer;
        }

        .item .stroke {
            flex: none;
            padding: 0 6px;
            border-right: 1px solid var(--bs-body-bg);
        }

        .item .stroke .duplicate {
            color: #fff;
            font-weight: bold;
        }

        .item .remove {
            flex: none;
            padding: 3px 8px 2px;
            cursor: pointer;
            color: #aaa;
            line-height: 1;
        }

        .item.conflict-item {
            background-color: var(--bs-danger);
            border-color: var(--bs-danger);
        }

        .add {
            flex: auto;
            display: none;
            color: #777;
            cursor: pointer;
            padding: 4px 10px 0;
            font-size: 0.85rem;
        }

        .add:first-child {
            display: block;
        }

        .add:hover,
        .item .body:hover,
        .item .remove:hover {
            background: var(--theme-bg-more);
        }

        .add:active,
        .item .body:active,
        .item .remove:active {
            background: var(--theme-bg-more-2);
        }

        .item.conflict-item .body:hover,
        .item.conflict-item .remove:hover {
            background: var(--theme-danger-less);
        }

        .item.conflict-item .body:active,
        .item.conflict-item .remove:active {
            background: var(--theme-danger-less-2);
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

        if (!filterLower && !this.capturedKeystroke) {
            results = results.filter(h => h.strokesArray.length > 0)
        }

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
        const result = await this.ngbModal.open(LocalHotkeyInputModalComponent).result
        if (result) {
            const current = this.getStrokesArray(hotkey.id)
            current.push(result)
            this.setHotkeys(hotkey.id, current)
        }
    }

    async editHotkey (hotkey: any, index: number) {
        const result = await this.ngbModal.open(LocalHotkeyInputModalComponent).result
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
