<?php
namespace Magento\Cookie\Helper\Cookie;

/**
 * Interceptor class for @see \Magento\Cookie\Helper\Cookie
 */
class Interceptor extends \Magento\Cookie\Helper\Cookie implements \Magento\Framework\Interception\InterceptorInterface
{
    use \Magento\Framework\Interception\Interceptor;

    public function __construct(\Magento\Framework\App\Helper\Context $context, \Magento\Store\Model\StoreManagerInterface $storeManager, array $data = [])
    {
        $this->___init();
        parent::__construct($context, $storeManager, $data);
    }

    /**
     * {@inheritdoc}
     */
    public function isUserNotAllowSaveCookie()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'isUserNotAllowSaveCookie');
        if (!$pluginInfo) {
            return parent::isUserNotAllowSaveCookie();
        } else {
            return $this->___callPlugins('isUserNotAllowSaveCookie', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function isCookieRestrictionModeEnabled()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'isCookieRestrictionModeEnabled');
        if (!$pluginInfo) {
            return parent::isCookieRestrictionModeEnabled();
        } else {
            return $this->___callPlugins('isCookieRestrictionModeEnabled', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getAcceptedSaveCookiesWebsiteIds()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getAcceptedSaveCookiesWebsiteIds');
        if (!$pluginInfo) {
            return parent::getAcceptedSaveCookiesWebsiteIds();
        } else {
            return $this->___callPlugins('getAcceptedSaveCookiesWebsiteIds', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function getCookieRestrictionLifetime()
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'getCookieRestrictionLifetime');
        if (!$pluginInfo) {
            return parent::getCookieRestrictionLifetime();
        } else {
            return $this->___callPlugins('getCookieRestrictionLifetime', func_get_args(), $pluginInfo);
        }
    }

    /**
     * {@inheritdoc}
     */
    public function isModuleOutputEnabled($moduleName = null)
    {
        $pluginInfo = $this->pluginList->getNext($this->subjectType, 'isModuleOutputEnabled');
        if (!$pluginInfo) {
            return parent::isModuleOutputEnabled($moduleName);
        } else {
            return $this->___callPlugins('isModuleOutputEnabled', func_get_args(), $pluginInfo);
        }
    }
}
