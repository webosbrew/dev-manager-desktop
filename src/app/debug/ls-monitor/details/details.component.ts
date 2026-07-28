import {Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy} from '@angular/core';
import {CallEntry, MonitorMessageItem} from "../ls-monitor.component";

@Component({
    selector: 'app-ls-monitor-details',
    templateUrl: './details.component.html',
    styleUrls: ['../ls-monitor.component.scss', './details.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DetailsComponent {

    detailsField!: CallEntry;

    @Output()
    closeClick = new EventEmitter<void>();

    selectedMessage?: MonitorMessageItem;

    @Input()
    set details(value: CallEntry) {
        this.detailsField = value;
        this.selectedMessage = value.messages[0];
    }

}
