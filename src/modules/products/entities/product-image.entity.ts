import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";
import { ApiProperty } from "@nestjs/swagger";

@Entity({ name: 'product_images' })
export class ProductImage {

    @ApiProperty({
        description: 'Unique identifier for the image',
        example: 1
    })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({
        description: 'URL of the image',
        example: 'https://example.com/image.jpg'
    })
    @Column('text')
    url: string;

    @ApiProperty({
        description: 'ID of the product',
        example: '8ed03f1d-7379-41f1-96e1-3f32a6623c66',
        type: String
    })
    @ManyToOne(
        () => Product,
        (product) => product.images,
        { onDelete: 'CASCADE' }
    )
    productId: Product;
}