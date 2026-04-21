import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import TabbyCoreModule from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { EnhancedHotkeySettingsTabComponent } from './components/enhancedHotkeySettingsTab.component'
import { LocalHotkeyInputModalComponent } from './components/hotkeyInputModal.component'
import { EnhancedHotkeySettingsTabProvider } from './settingsTabProvider'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: SettingsTabProvider, useClass: EnhancedHotkeySettingsTabProvider, multi: true },
    ],
    entryComponents: [
        EnhancedHotkeySettingsTabComponent,
        LocalHotkeyInputModalComponent,
    ],
    declarations: [
        EnhancedHotkeySettingsTabComponent,
        LocalHotkeyInputModalComponent,
    ],
})
export default class EnhancedHotkeysModule { }
