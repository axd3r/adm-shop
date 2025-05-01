import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
    
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
        uniqueItems: true
    })
    @IsEmail()
    email: string;
    
    @ApiProperty({
        description: 'User password. Must include uppercase, lowercase, and a number or special character.',
        example: '123Abc',
        minLength: 6,
        maxLength: 50
    })
    @IsString()
    @MinLength(6)
    @MaxLength(50)
    @Matches(
    /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'The password must have a Uppercase, lowercase letter and a number'
    })
    password: string;
    
    @ApiProperty({
        description: 'Full name of the user',
        example: 'User Bot',
        minLength: 1
    })
    @IsString()
    @MinLength(1)
    fullName:  string;

    @ApiProperty({
        description: 'Roles assigned to the user',
        example: ['user', 'admin', 'super-user'],
        isArray: true
    })
    @IsString({ each: true })
    @IsArray()
    @IsOptional()
    roles?: string[];
}
