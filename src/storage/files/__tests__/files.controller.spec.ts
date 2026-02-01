import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesController } from '../files.controller';
import { FilesService } from '../files.service';
import { Response } from 'express';

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: jest.Mocked<FilesService>;
  let configService: jest.Mocked<ConfigService>;

  const mockResponse = {
    sendFile: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: {
            getStaticProductImgae: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    filesService = module.get(FilesService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findProductImage', () => {
    it('should return image file', () => {
      const imagePath = '/path/to/image.jpg';
      filesService.getStaticProductImgae.mockReturnValue(imagePath);

      controller.findProductImage(mockResponse, 'image.jpg');

      expect(filesService.getStaticProductImgae).toHaveBeenCalledWith(
        'image.jpg',
      );
      expect(mockResponse.sendFile).toHaveBeenCalledWith(imagePath);
    });

    it('should throw when image not found', () => {
      filesService.getStaticProductImgae.mockImplementation(() => {
        throw new BadRequestException(
          'No product found with image notfound.jpg',
        );
      });

      expect(() =>
        controller.findProductImage(mockResponse, 'notfound.jpg'),
      ).toThrow(BadRequestException);
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return secure URL', () => {
      const mockFile = {
        filename: 'uploaded-image.jpg',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const result = controller.uploadFile(mockFile);

      expect(result).toEqual({
        fileName: 'http://localhost:3000/files/product/uploaded-image.jpg',
      });
    });

    it('should throw BadRequestException if no file provided', () => {
      expect(() => controller.uploadFile(undefined as any)).toThrow(
        BadRequestException,
      );
      expect(() => controller.uploadFile(undefined as any)).toThrow(
        'Make you sure is a image, jpg, pn, or gif',
      );
    });

    it('should throw BadRequestException if file is null', () => {
      expect(() => controller.uploadFile(null as any)).toThrow(
        BadRequestException,
      );
    });
  });
});
