import {InfoComponent} from "./info.component";
import {APP_ID_HBCHANNEL} from "../shared/constants";
import {MessageDialogComponent} from "../shared/components/message-dialog/message-dialog.component";

describe('InfoComponent', () => {
    function setup() {
        const appManager = {
            launch: jasmine.createSpy('launch').and.resolveTo(undefined),
        };
        const component = new InfoComponent(
            {} as any,
            {selected$: {subscribe: () => ({unsubscribe: () => undefined})}} as any,
            {} as any,
            appManager as any,
            {} as any,
            {} as any
        );
        component.device = {name: 'test-device'} as any;
        return {component, appManager};
    }

    it('launches Homebrew Channel addRepository mode for valid custom repo URL', async () => {
        const {component, appManager} = setup();
        component.homebrewCustomRepoUrl = 'https://example.com/repo.json';

        await component.addCustomRepoToHomebrew();

        expect(appManager.launch).toHaveBeenCalledWith(
            component.device,
            APP_ID_HBCHANNEL,
            {
                launchMode: 'addRepository',
                url: 'https://example.com/repo.json',
            }
        );
        expect(component.homebrewCustomRepoUrl).toBe('');
    });

    it('shows error and does not launch when URL is invalid', async () => {
        const {component, appManager} = setup();
        const dialogSpy = spyOn(MessageDialogComponent, 'open');
        component.homebrewCustomRepoUrl = 'not-a-url';

        await component.addCustomRepoToHomebrew();

        expect(appManager.launch).not.toHaveBeenCalled();
        expect(dialogSpy).toHaveBeenCalled();
    });
});
