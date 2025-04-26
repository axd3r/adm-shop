import { Injectable } from '@nestjs/common';
import { ProductsService } from 'src/modules/products/products.service';
import { initialData } from './interfaces/seed.data';

@Injectable()
export class SeedService {

  constructor(
    private readonly productsService: ProductsService,
  ) {}

  async executeSeed() {
    await this.insertNewProducts();
    return `SEED EXECUTED`;
  }

  private async insertNewProducts() {
    await this.productsService.deleteAllProducts();
    const products =  initialData.products;

    const insertPromsies: Promise<any>[] = [];
    products.forEach( product => {
      insertPromsies.push(this.productsService.create(product))
    })

    await Promise.all(insertPromsies)
    
    return true;
  }
}
