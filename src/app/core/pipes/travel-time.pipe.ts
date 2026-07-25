import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'travelTime', standalone: true, pure: true })
export class TravelTimePipe implements PipeTransform {
  transform(utcDate: string | Date | null | undefined, timezone: string, format: 'datetime' | 'date' | 'time' = 'datetime'): string {
    if (!utcDate) return '-';

    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    if (isNaN(date.getTime())) return '-';

    const options: Intl.DateTimeFormatOptions = { timeZone: timezone };

    switch (format) {
      case 'date':
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      default:
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return new Intl.DateTimeFormat('zh-TW', options).format(date);
  }
}
