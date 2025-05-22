import {Pipe, PipeTransform} from "@angular/core";
import {filesize, FileSizeOptions} from 'filesize';

@Pipe({
    name: 'filesize',
    standalone: true
})
export class FilesizePipe implements PipeTransform {

    transform(bytes: number, options: Partial<FileSizeOptions>): string {
        return filesize(bytes, {output: "string", ...options});
    }

}
