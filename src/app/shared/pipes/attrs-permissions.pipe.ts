import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'attrsPermissions'
})
export class AttrsPermissionsPipe implements PipeTransform {

  transform(mode: number): string {
    return `${str((mode >> 6) & 7)}${str((mode >> 3) & 7)}${str(mode & 7)}`;
  }

}

function str(bits: number): string {
  return `${bits & 4 ? 'r' : '-'}${bits & 2 ? 'w' : '-'}${bits & 1 ? 'x' : '-'}`;
}
