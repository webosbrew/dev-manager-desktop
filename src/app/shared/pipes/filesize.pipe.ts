import {Pipe, PipeTransform} from "@angular/core";
import {filesize, FileSizeOptionsBase} from 'filesize';

@Pipe({
    name: 'filesize',
    standalone: false
})
export class FilesizePipe implements PipeTransform {

    transform(bytes: number, options: Partial<FileSizeOptionsBase>): string {
        return filesize(bytes, {output: "string", ...options});
    }

}
