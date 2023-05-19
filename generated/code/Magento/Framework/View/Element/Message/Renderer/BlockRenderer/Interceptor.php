<?php
namespace Magento\Framework\View\Element\Message\Renderer\BlockRenderer;

/**
 * Interceptor class for @see \Magento\Framework\View\Element\Message\Renderer\BlockRenderer
 */
class Interceptor extends \Magento\Framework\View\Element\Message\Renderer\BlockRenderer implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\Framework\View\Element\Message\Renderer\BlockRenderer\Template $template)
    {
        $this->___init();
        parent::__construct($template);
    }

    /**
     * {@inheritdoc}
     */
    public function render(\Magento\Framework\Message\MessageInterface $message, array $initializationData)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'render');
        if (!$pluginInfo) {
            return parent::render($message, $initializationData);
        } else {
            return $this->___callPlugins('render', func_get_args(), $pluginInfo);
        }
    }
}
