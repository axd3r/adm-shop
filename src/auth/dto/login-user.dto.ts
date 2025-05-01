import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches } from "class-validator";

export class LoginUserDTO {

    @ApiProperty({
        description: 'Email address of the user',
        example: 'user@example.com'
    })
    @IsString()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password. Must contain at least one uppercase letter, one lowercase letter, and one number',
        example: 'StrongPass1'
    })
    @IsString()
    @Matches(
        /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'The password must have a Uppercase, lowercase letter and a number'
    })
    password: string;
}