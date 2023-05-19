<?php
namespace Sparsh\OrderComments\Observer;

/**
 * Class AddOrderCommentsToOrder
 * @package Sparsh\OrderComments\Observer
 */
class AddOrderCommentsToOrder implements \Magento\Framework\Event\ObserverInterface
{
    /**
     * @param \Magento\Framework\Event\Observer $observer
     */
    public function execute(\Magento\Framework\Event\Observer $observer)
    {
        $order = $observer->getEvent()->getOrder();
        $quote = $observer->getEvent()->getQuote();
        
        $order->setData('sparsh_order_comments', $quote->getSparshOrderComments());
    }
}
