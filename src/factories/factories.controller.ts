import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { FactoriesService } from './factories.service';

@ApiTags('Предприятия')
@Controller('factories')
export class FactoriesController {
  constructor(private readonly factoriesService: FactoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Список всех предприятий' })
  getEnterprises() {
    return this.factoriesService.getEnterprises();
  }

  @Get(':enterprise/products')
  @ApiOperation({ summary: 'Список продуктов предприятия' })
  @ApiParam({ name: 'enterprise', example: 'ВНП' })
  getProducts(@Param('enterprise') enterprise: string) {
    return this.factoriesService.getProducts(enterprise);
  }

  @Get(':enterprise/products/:product')
  @ApiOperation({ summary: 'Данные по продукту предприятия' })
  @ApiParam({ name: 'enterprise', example: 'ВНП' })
  @ApiParam({ name: 'product', example: 'Нафта' })
  getProductData(
    @Param('enterprise') enterprise: string,
    @Param('product') product: string,
  ) {
    return this.factoriesService.getProductData(enterprise, product);
  }
}
