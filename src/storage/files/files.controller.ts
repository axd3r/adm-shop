import { BadRequestException, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from '../helpers/fileFilter.helper';
import { diskStorage } from 'multer';
import { fileNamer } from '../helpers/fileNamer.helper';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('files')
export class FilesController {
  constructor(
    private readonly configService: ConfigService,
    private readonly filesService: FilesService) {}

  @Get('product/:imageName')
  findProductImage(
    @Res() res: Response,
    @Param('imageName') imageName: string
  ){
    const path = this.filesService.getStaticProductImgae(imageName);
    return res.sendFile(path);
  }

  @Post('product')
  @UseInterceptors( FileInterceptor('file0', {
    fileFilter: fileFilter,
    storage: diskStorage({
      destination: './static/products',
      filename: fileNamer
    })
  }))
  uploadFile(@UploadedFile('file') file: Express.Multer.File) {
    if(!file) {
      throw new BadRequestException(`Make you sure is a image, jpg, pn, or gif`);
    }

    const secureURL = `${this.configService.get('HOST_API')}/files/product/${file.filename}`;
    return {
      fileName: secureURL
    };
  }
}
