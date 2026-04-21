import { Component, Input, OnInit, OnDestroy } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { HotkeysService, Keystroke, ConfigService } from 'tabby-core'

const INPUT_TIMEOUT = 1000

@Component({
    template: `
        <div class="modal-body">
            <div class="text-center py-5">
                <h4 class="mb-4">{{ "Press the key combination" | translate }}</h4>
                <div class="d-flex justify-content-center mb-4 min-h-50">
                    <div class="hotkey-item mx-1" *ngFor="let keystroke of value">
                        <div class="hotkey-body">
                            <span class="hotkey-stroke">{{ keystroke }}</span>
                        </div>
                    </div>
                </div>
                <div class="progress">
                    <div class="progress-bar" [style.width.%]="timeoutProgress"></div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .min-h-50 { min-height: 50px; }
        .hotkey-item {
            display: flex;
            align-items: stretch;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
        }
        .hotkey-body { padding: 4px 12px; }
        .hotkey-stroke { font-family: monospace; font-size: 1.2rem; }
    `]
})
export class LocalHotkeyInputModalComponent implements OnInit, OnDestroy {
    @Input() value: Keystroke[] = []
    @Input() timeoutProgress = 0

    private lastKeyEvent: number|null = null
    private keyTimeoutInterval: any = null

    constructor (
        private modalInstance: NgbActiveModal,
        private hotkeys: HotkeysService,
        public config: ConfigService,
    ) { }

    ngOnInit (): void {
        this.hotkeys.clearCurrentKeystrokes()
        this.hotkeys.disable()

        // We use a simplified subscription for the plugin
        const keystrokeSub = this.hotkeys.keystroke$.subscribe(keystroke => {
            this.lastKeyEvent = performance.now()
            this.value.push(keystroke)
        })

        this.keyTimeoutInterval = window.setInterval(() => {
            if (!this.lastKeyEvent) return
            this.timeoutProgress = Math.min(100, (performance.now() - this.lastKeyEvent) * 100 / INPUT_TIMEOUT)
            if (this.timeoutProgress === 100) {
                clearInterval(this.keyTimeoutInterval)
                keystrokeSub.unsubscribe()
                this.modalInstance.close(this.value)
            }
        }, 25)
    }

    ngOnDestroy (): void {
        if (this.keyTimeoutInterval) clearInterval(this.keyTimeoutInterval)
        this.hotkeys.clearCurrentKeystrokes()
        this.hotkeys.enable()
    }

    close (): void {
        this.modalInstance.dismiss()
    }
}
