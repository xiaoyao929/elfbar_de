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

namespace Sparsh\VideoGallery\Block\Adminhtml\Video;

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

class Edit extends \Magento\Backend\Block\Widget\Form\Container
{
    /**
     * Core registry
     *
     * @var \Magento\Framework\Registry
     */
    protected $coreRegistry = null;

    /**
     * Initialize
     *
     * @param \Magento\Backend\Block\Widget\Context $context  Initialize context
     * @param \Magento\Framework\Registry           $registry Initialize registery
     * @param array                                 $data     data array
     */
    public function __construct(
        \Magento\Backend\Block\Widget\Context $context,
        \Magento\Framework\Registry $registry,
        array $data = []
    ) {
        $this->coreRegistry = $registry;
        parent::__construct($context, $data);
    }

    /**
     * Initialize Video Detail edit block
     *
     * @return void
     */
    protected function _construct()
    {
        $this->_objectId = 'id';
        $this->_blockGroup = 'Sparsh_VideoGallery';
        $this->_controller = 'adminhtml_video';

        parent::_construct();

        if ($this->_isAllowedAction('Sparsh_VideoGallery::save')) {
            $this->buttonList->update('save', 'label', __('Save'));
            $this->buttonList->add(
                'saveandcontinue',
                [
                    'label' => __('Save and Continue Edit'),
                    'class' => 'save',
                    'data_attribute' => [
                        'mage-init' => [
                            'button' => ['event' => 'saveAndContinueEdit', 'target' => '#edit_form'],
                        ],
                    ]
                ],
                -100
            );
        } else {
            $this->buttonList->remove('save');
        }

        if ($this->_isAllowedAction('Sparsh_VideoGallery::video_delete')) {
            $this->buttonList->update('delete', 'label', __('Delete Video'));
        } else {
            $this->buttonList->remove('delete');
        }
    }

    /**
     * Retrieve text for header element depending on loaded post
     *
     * @return \Magento\Framework\Phrase
     */
    public function getHeaderText()
    {
        if ($this->coreRegistry->registry('current_category')->getId()) {
            return __("Edit video '%1'", $this->escapeHtml($this->coreRegistry->registry('current_category')->getTitle()));
        } else {
            return __('New Video');
        }
    }

    /**
     * Check permission for passed action
     *
     * @param string $resourceId resourceID
     *
     * @return bool
     */
    protected function _isAllowedAction($resourceId)
    {
        return $this->_authorization->isAllowed($resourceId);
    }

    /**
     * Getter of url for "Save and Continue" button
     * tab_id will be replaced by desired by JS later
     *
     * @return string
     */
    protected function _getSaveAndContinueUrl()
    {
        return $this->getUrl('videogallery/*/save', ['_current' => true, 'back' => 'edit', 'active_tab' => '']);
    }
}