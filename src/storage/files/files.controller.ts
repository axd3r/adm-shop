import { BadRequestException, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from '../helpers/fileFilter.helper';
import { diskStorage } from 'multer';
import { fileNamer } from '../helpers/fileNamer.helper';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductImage } from 'src/modules/products/entities/product-image.entity';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly configService: ConfigService,
    private readonly filesService: FilesService) {}

  @Get('product/:imageName')
  @ApiOperation({ summary: 'Return product image by name' })
  @ApiParam({ name: 'imageName', description: 'Name of the image file' })
  @ApiResponse({ status: 200, description: 'Image returned successfully', type: ProductImage})
  @ApiResponse({ status: 404, description: 'Image not found' })
  findProductImage(
    @Res() res: Response,
    @Param('imageName') imageName: string
  ){
    const path = this.filesService.getStaticProductImgae(imageName);
    return res.sendFile(path);
  }

  @Post('product')
  @ApiOperation({ summary: 'Upload product image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Image uploaded successfully', type: ProductImage })
  @ApiResponse({ status: 400, description: 'Invalid file or format' })
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
