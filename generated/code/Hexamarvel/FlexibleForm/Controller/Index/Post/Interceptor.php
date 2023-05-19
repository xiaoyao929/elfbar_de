<?php
namespace Hexamarvel\FlexibleForm\Controller\Index\Post;

/**
 * Interceptor class for @see \Hexamarvel\FlexibleForm\Controller\Index\Post
 */
class Interceptor extends \Hexamarvel\FlexibleForm\Controller\Index\Post implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\Framework\App\Action\Context $context, \Magento\Framework\Controller\ResultFactory $resultPageFactory, \Hexamarvel\FlexibleForm\Helper\Data $helper, \Hexamarvel\FlexibleForm\Model\FormDataFactory $formDataFactory, \Hexamarvel\FlexibleForm\Model\FormFactory $formCollection, \Hexamarvel\FlexibleForm\Model\FieldFactory $fieldFactory, \Magento\Framework\Mail\Template\TransportBuilder $transportBuilder, \Magento\Framework\Translate\Inline\StateInterface $inlineTranslation, \Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig, \Magento\Store\Model\StoreManagerInterface $storeManager, \Magento\Directory\Model\RegionFactory $regionFactory, \Magento\Directory\Model\CountryFactory $countryFactory, \Hexamarvel\FlexibleForm\Model\FileUploader $fileUploader, \Magento\Captcha\Helper\Data $captchaHelper, \Magento\Framework\App\ActionFlag $actionFlag, \Magento\Captcha\Observer\CaptchaStringResolver $captchaStringResolver, \Magento\Framework\ObjectManagerInterface $objectmanager)
    {
        $this->___init();
        parent::__construct($context, $resultPageFactory, $helper, $formDataFactory, $formCollection, $fieldFactory, $transportBuilder, $inlineTranslation, $scopeConfig, $storeManager, $regionFactory, $countryFactory, $fileUploader, $captchaHelper, $actionFlag, $captchaStringResolver, $objectmanager);
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
    public function getFormDetails($post)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getFormDetails');
        if (!$pluginInfo) {
            return parent::getFormDetails($post);
        } else {
            return $this->___callPlugins('getFormDetails', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getEmailInfo($path, $scope = null)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getEmailInfo');
        if (!$pluginInfo) {
            return parent::getEmailInfo($path, $scope);
        } else {
            return $this->___callPlugins('getEmailInfo', func_get_args(), $pluginInfo);
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
