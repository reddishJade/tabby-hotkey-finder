import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { EnhancedHotkeySettingsTabComponent } from './components/enhancedHotkeySettingsTab.component'

/** @hidden */
@Injectable()
export class EnhancedHotkeySettingsTabProvider extends SettingsTabProvider {
    id = 'hotkey-finder'
    icon = 'fas fa-search'
    title = 'Hotkey Finder'

    getComponentType (): any {
        return EnhancedHotkeySettingsTabComponent
    }
}
