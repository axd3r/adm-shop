import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class LoginUserDTO {

    @IsString()
    @IsEmail()
    email: string;

    @IsString()
    @Matches(
    /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'The password must have a Uppercase, lowercase letter and a number'
    })
    password: string;
}