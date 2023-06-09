<?php

/**
 * PHP version 7.1
 *
 * @category  Sparsh
 * @package   Sparsh_VideoGallery
 * @author    Sparsh <magento@sparsh-technologies.com>
 * @copyright 2019 This file was generated by Sparsh
 * @license   https://www.sparsh-technologies.com  Open Software License (OSL 3.0)
 * @link      https://www.sparsh-technologies.com
 */

namespace Sparsh\VideoGallery\Model\ResourceModel;

use Magento\Framework\Model\ResourceModel\Db\AbstractDb;

/**
 * PHP version 7.1
 *
 * @category  Sparsh
 * @package   Sparsh_VideoGallery
 * @author    Sparsh <magento@sparsh-technologies.com>
 * @copyright 2019 This file was generated by Sparsh
 * @license   https://www.sparsh-technologies.com  Open Software License (OSL 3.0)
 * @link      https://www.sparsh-technologies.com
 */

class Video extends AbstractDb
{

    /**
     * Initialize
     *
     * @return Null
     */
    protected function _construct()
    {
        $this->_init('sparsh_video_gallery', 'id');
    }
}
