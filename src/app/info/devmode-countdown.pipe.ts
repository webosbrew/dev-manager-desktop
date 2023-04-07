import {Pipe, PipeTransform} from '@angular/core';
import {Observable, of, timer} from "rxjs";
import {DateTime, Duration, DurationLikeObject} from "luxon";
import {map} from "rxjs/operators";

@Pipe({
  name: 'devmodeCountdown'
})
export class DevmodeCountdownPipe implements PipeTransform {

  transform(value?: string): Observable<string> {
    const remainingMatches = RegExp(/^(?<hour>\d+):(?<minute>\d+):(?<second>\d+)$/)
      .exec(value ?? '');
    if (remainingMatches) {
      const expireDate = DateTime.now().plus(Duration.fromDurationLike(remainingMatches.groups as
        Pick<DurationLikeObject, 'hour' | 'minute' | 'second'>));
      return timer(0, 1000).pipe(map(() => expireDate
        .diffNow('seconds').toFormat('hh:mm:ss')));
    } else {
      return of("--:--");
    }
  }

}
