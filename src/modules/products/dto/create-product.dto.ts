import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateProductDto {
    @IsString()
    title: string;

    @IsNumber()
    @IsPositive()
    price: number;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    slug?: string;

    @IsInt()
    @IsPositive()
    @IsOptional()
    stock?: number;

    @IsString({ each: true })
    @IsArray()
    sizes: string[];

    @IsIn(['men', 'women', 'kid', 'unisex'])
    @IsString()
    gender: string;

    @IsString({each: true})
    @IsArray()
    @IsOptional()
    tags?: string[]

    @IsString({each: true})
    @IsArray()
    @IsOptional()
    images?: string[]
}
