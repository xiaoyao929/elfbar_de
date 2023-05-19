<?php
namespace Magento\CatalogInventory\Model\Stock\StockItemRepository;

/**
 * Interceptor class for @see \Magento\CatalogInventory\Model\Stock\StockItemRepository
 */
class Interceptor extends \Magento\CatalogInventory\Model\Stock\StockItemRepository implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\CatalogInventory\Api\StockConfigurationInterface $stockConfiguration, \Magento\CatalogInventory\Model\Spi\StockStateProviderInterface $stockStateProvider, \Magento\CatalogInventory\Model\ResourceModel\Stock\Item $resource, \Magento\CatalogInventory\Api\Data\StockItemInterfaceFactory $stockItemFactory, \Magento\CatalogInventory\Api\Data\StockItemCollectionInterfaceFactory $stockItemCollectionFactory, \Magento\Catalog\Model\ProductFactory $productFactory, \Magento\Framework\DB\QueryBuilderFactory $queryBuilderFactory, \Magento\Framework\DB\MapperFactory $mapperFactory, \Magento\Framework\Stdlib\DateTime\TimezoneInterface $localeDate, \Magento\CatalogInventory\Model\Indexer\Stock\Processor $indexProcessor, \Magento\Framework\Stdlib\DateTime\DateTime $dateTime, ?\Magento\Catalog\Model\ResourceModel\Product\CollectionFactory $productCollectionFactory = null)
    {
        $this->___init();
        parent::__construct($stockConfiguration, $stockStateProvider, $resource, $stockItemFactory, $stockItemCollectionFactory, $productFactory, $queryBuilderFactory, $mapperFactory, $localeDate, $indexProcessor, $dateTime, $productCollectionFactory);
    }

    /**
     * {@inheritdoc}
     */
    public function save(\Magento\CatalogInventory\Api\Data\StockItemInterface $stockItem)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'save');
        if (!$pluginInfo) {
            return parent::save($stockItem);
        } else {
            return $this->___callPlugins('save', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function get($stockItemId)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'get');
        if (!$pluginInfo) {
            return parent::get($stockItemId);
        } else {
            return $this->___callPlugins('get', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getList(\Magento\CatalogInventory\Api\StockItemCriteriaInterface $criteria)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getList');
        if (!$pluginInfo) {
            return parent::getList($criteria);
        } else {
            return $this->___callPlugins('getList', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function delete(\Magento\CatalogInventory\Api\Data\StockItemInterface $stockItem)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'delete');
        if (!$pluginInfo) {
            return parent::delete($stockItem);
        } else {
            return $this->___callPlugins('delete', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function deleteById($id)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'deleteById');
        if (!$pluginInfo) {
            return parent::deleteById($id);
        } else {
            return $this->___callPlugins('deleteById', func_get_args(), $pluginInfo);
        }
    }
}
