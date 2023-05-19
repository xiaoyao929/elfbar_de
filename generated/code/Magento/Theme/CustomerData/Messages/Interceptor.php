<?php
namespace Magento\Theme\CustomerData\Messages;

/**
 * Interceptor class for @see \Magento\Theme\CustomerData\Messages
 */
class Interceptor extends \Magento\Theme\CustomerData\Messages implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\Framework\Message\ManagerInterface $messageManager, \Magento\Framework\View\Element\Message\InterpretationStrategyInterface $interpretationStrategy)
    {
        $this->___init();
        parent::__construct($messageManager, $interpretationStrategy);
    }

    /**
     * {@inheritdoc}
     */
    public function getSectionData()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getSectionData');
        if (!$pluginInfo) {
            return parent::getSectionData();
        } else {
            return $this->___callPlugins('getSectionData', func_get_args(), $pluginInfo);
        }
    }
}
