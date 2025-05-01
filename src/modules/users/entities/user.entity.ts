import { ApiProperty } from "@nestjs/swagger";
import { Exclude } from "class-transformer";
import { Product } from "src/modules/products/entities/product.entity";
import { BeforeInsert, BeforeUpdate, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity('users')
export class User {
    @ApiProperty({
        description: 'Unique identifier of the user',
        example: 'b3f2e0b2-12ec-4a45-bd73-2c02b1d1a3df'
    })
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty({
        description: 'Email address of the user',
        example: 'user@example.com',
        uniqueItems: true
    })
    @Column('text', {
        unique: true
    })
    email: string;

    @Column('text', {
        select: false
    })
    @Exclude()
    password: string;

    @ApiProperty({
        description: 'Full name of the user',
        example: 'John Doe'
    })
    @Column('text')
    fullName: string;

    @Column('bool', {
        default: true,
    })
    @Exclude()
    isActive: boolean;

    @ApiProperty({
        description: 'Roles assigned to the user',
        example: ['user', 'admin', 'super-user'],
        isArray: true
    })
    @Column('text', {
        array: true,
        default: ['user']
    })
    roles: string[];

    @OneToMany(
        () => Product,
        ( product ) => product.user
    )
    product: Product

    @BeforeInsert()
    checkFieldsBeforeInsert() {
        this.email = this.email.toLowerCase().trim();
    }

    @BeforeUpdate()
    checkFieldsBeforeUpdate() {
        this.checkFieldsBeforeInsert();
    }
}
