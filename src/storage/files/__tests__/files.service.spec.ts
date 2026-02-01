import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FilesService } from '../files.service';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStaticProductImgae', () => {
    it('should return path if file exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = service.getStaticProductImgae('test-image.jpg');

      expect(result).toContain('test-image.jpg');
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should throw BadRequestException if file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => service.getStaticProductImgae('nonexistent.jpg')).toThrow(
        BadRequestException,
      );
      expect(() => service.getStaticProductImgae('nonexistent.jpg')).toThrow(
        'No product found with image nonexistent.jpg',
      );
    });

    it('should construct correct path', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = service.getStaticProductImgae('product-123.png');

      expect(result).toContain('static');
      expect(result).toContain('products');
      expect(result).toContain('product-123.png');
    });
  });
});
