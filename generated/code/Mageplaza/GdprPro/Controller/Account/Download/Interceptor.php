<?php
namespace Mageplaza\GdprPro\Controller\Account\Download;

/**
 * Interceptor class for @see \Mageplaza\GdprPro\Controller\Account\Download
 */
class Interceptor extends \Mageplaza\GdprPro\Controller\Account\Download implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\Framework\App\Action\Context $context, \Magento\Framework\View\Result\PageFactory $resultPageFactory, \Magento\Framework\App\Response\Http\FileFactory $fileFactory, \Magento\Framework\Filesystem $filesystem, \Magento\Framework\File\Csv $csvProcessor, \Magento\Framework\Convert\ExcelFactory $excelFactory, \Magento\Framework\Filesystem\File\WriteFactory $fileWriteFactory, \Magento\Framework\Filesystem\Driver\File $driverFile, \Magento\Customer\Model\Session $customerSession, \Magento\Customer\Api\CustomerRepositoryInterface $customerRepositoryInterface, \Magento\Framework\Message\ManagerInterface $messageManager, \Magento\Framework\Stdlib\DateTime\TimezoneInterface $timeZone, \Magento\Framework\Stdlib\DateTime\DateTime $date, \Magento\Store\Model\StoreManagerInterface $storeManager, \Mageplaza\GdprPro\Model\DownloadLogsFactory $downloadLogsFactory)
    {
        $this->___init();
        parent::__construct($context, $resultPageFactory, $fileFactory, $filesystem, $csvProcessor, $excelFactory, $fileWriteFactory, $driverFile, $customerSession, $customerRepositoryInterface, $messageManager, $timeZone, $date, $storeManager, $downloadLogsFactory);
    }

    /**
     * {@inheritdoc}
     */
    public function execute()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'execute');
        if (!$pluginInfo) {
            return parent::execute();
        } else {
            return $this->___callPlugins('execute', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function formatDate($date)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'formatDate');
        if (!$pluginInfo) {
            return parent::formatDate($date);
        } else {
            return $this->___callPlugins('formatDate', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function exportToCSV($stream, $customerData)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'exportToCSV');
        if (!$pluginInfo) {
            return parent::exportToCSV($stream, $customerData);
        } else {
            return $this->___callPlugins('exportToCSV', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function exportToXML($stream, $collection)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'exportToXML');
        if (!$pluginInfo) {
            return parent::exportToXML($stream, $collection);
        } else {
            return $this->___callPlugins('exportToXML', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getCustomerData(\Magento\Framework\DataObject $data)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getCustomerData');
        if (!$pluginInfo) {
            return parent::getCustomerData($data);
        } else {
            return $this->___callPlugins('getCustomerData', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function formatAddressData($addressData, $checkXmlFile = false)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'formatAddressData');
        if (!$pluginInfo) {
            return parent::formatAddressData($addressData, $checkXmlFile);
        } else {
            return $this->___callPlugins('formatAddressData', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function formatCustomerData($customerData, $checkXmlFile = false)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'formatCustomerData');
        if (!$pluginInfo) {
            return parent::formatCustomerData($customerData, $checkXmlFile);
        } else {
            return $this->___callPlugins('formatCustomerData', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function dispatch(\Magento\Framework\App\RequestInterface $request)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'dispatch');
        if (!$pluginInfo) {
            return parent::dispatch($request);
        } else {
            return $this->___callPlugins('dispatch', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getActionFlag()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getActionFlag');
        if (!$pluginInfo) {
            return parent::getActionFlag();
        } else {
            return $this->___callPlugins('getActionFlag', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getRequest()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getRequest');
        if (!$pluginInfo) {
            return parent::getRequest();
        } else {
            return $this->___callPlugins('getRequest', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getResponse()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getResponse');
        if (!$pluginInfo) {
            return parent::getResponse();
        } else {
            return $this->___callPlugins('getResponse', func_get_args(), $pluginInfo);
        }
    }
}
