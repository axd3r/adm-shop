import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateProductDto {
    
    @ApiProperty({
        description: 'Product title',
        example: 'T-shirt Nike 2024',
        minLength: 1
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Product price in USD',
        example: 29.99,
        minimum: 0.01
    })
    @IsNumber()
    @IsPositive()
    price: number;

    @ApiProperty({
        description: 'Product description',
        example: 'A comfortable and stylish Nike T-shirt for summer.',
        required: false
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        description: 'SEO-friendly URL slug',
        example: 'tshirt-nike-2024',
        required: false
    })
    @IsString()
    @IsOptional()
    slug?: string;

    @ApiProperty({
        description: 'Available stock units',
        example: 100,
        required: false,
        minimum: 0
    })
    @IsInt()
    @IsPositive()
    @IsOptional()
    stock?: number;

    @ApiProperty({
        description: 'Available sizes',
        example: ['S', 'M', 'L', 'XL'],
        type: [String]
    })
    @IsString({ each: true })
    @IsArray()
    sizes: string[];

    @ApiProperty({
        description: 'Product gender category',
        example: 'unisex',
        enum: ['men', 'women', 'kid', 'unisex']
    })
    @IsIn(['men', 'women', 'kid', 'unisex'])
    @IsString()
    gender: string;

    @ApiProperty({
        description: 'Product tags for filtering',
        example: ['summer', 'sport', 'casual'],
        required: false,
        type: [String]
    })
    @IsString({each: true})
    @IsArray()
    @IsOptional()
    tags?: string[]

    @ApiProperty({
        description: 'Image URLs',
        example: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        required: false,
        type: [String]
    })
    @IsString({each: true})
    @IsArray()
    @IsOptional()
    images?: string[]
}
