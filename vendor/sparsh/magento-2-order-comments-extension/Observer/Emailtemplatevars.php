<?php
namespace Sparsh\OrderComments\Observer;

/**
 * Class Emailtemplatevars
 * @package Sparsh\OrderComments\Observer
 */
class Emailtemplatevars implements \Magento\Framework\Event\ObserverInterface
{
    /**
     * @param \Magento\Framework\Event\Observer $observer
     */
    public function execute(\Magento\Framework\Event\Observer $observer)
    {
        $transport = $observer->getEvent()->getTransport();
        if ($transport->getOrder() != null) {
            $transport['Sparshordercomment'] = $transport->getOrder()->getSparshOrderComments();
        }
    }
}
