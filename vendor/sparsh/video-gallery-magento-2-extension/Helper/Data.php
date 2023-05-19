<?php

namespace Sparsh\VideoGallery\Helper;

class Data extends \Magento\Framework\App\Helper\AbstractHelper
{
    const VIDEO_TITLE = 'video/general/display_title';
    public function getTitle()
    {
        return $this->scopeConfig->getValue(
            self::VIDEO_TITLE,
            \Magento\Store\Model\ScopeInterface::SCOPE_STORE
        );
    }
}
