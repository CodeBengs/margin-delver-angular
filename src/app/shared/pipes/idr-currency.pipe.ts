import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'idrCurrency',
  standalone: true
})
export class IdrCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }

    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(value);
  }
}

