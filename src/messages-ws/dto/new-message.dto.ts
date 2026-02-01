import { IsString, MinLength } from 'class-validator';

export class NewMessageDTO {
  @IsString()
  @MinLength(1)
  message: string;
}
