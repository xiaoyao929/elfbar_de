<?php
namespace Hexamarvel\FlexibleForm\Controller\Router;

/**
 * Interceptor class for @see \Hexamarvel\FlexibleForm\Controller\Router
 */
class Interceptor extends \Hexamarvel\FlexibleForm\Controller\Router implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\Framework\App\ActionFactory $actionFactory, \Magento\Framework\Event\ManagerInterface $eventManager, \Hexamarvel\FlexibleForm\Helper\Data $helper, \Hexamarvel\FlexibleForm\Model\ResourceModel\Form\CollectionFactory $formFactory, \Magento\Store\Model\StoreManagerInterface $storeManager)
    {
        $this->___init();
        parent::__construct($actionFactory, $eventManager, $helper, $formFactory, $storeManager);
    }

    /**
     * {@inheritdoc}
     */
    public function match(\Magento\Framework\App\RequestInterface $request)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'match');
        if (!$pluginInfo) {
            return parent::match($request);
        } else {
            return $this->___callPlugins('match', func_get_args(), $pluginInfo);
        }
    }
}
