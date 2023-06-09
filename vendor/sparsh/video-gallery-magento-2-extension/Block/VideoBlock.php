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

namespace Sparsh\VideoGallery\Block;

use Magento\Framework\View\Element\Template\Context;
use Magento\Widget\Block\BlockInterface;
use Magento\Framework\View\Element\Template;

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

class VideoBlock extends Template implements BlockInterface
{
    /**
     * Store Manager
     *
     * @var \Magento\Store\Model\StoreManagerInterface
     */
    protected $storeManager;

    /**
     * @var string
     */
    protected $_template = "VideoTemplate.phtml";

    /**
     * @var \Magento\Framework\App\Response\RedirectInterface
     */
    protected $redirect;

    /**
     * @var \Magento\Framework\App\RequestInterface
     */
    protected $request;

    /**
     * @var \Sparsh\VideoGallery\Helper\Data
     */
    protected $_helper;

    /**
     * @var \Magento\Framework\App\Response\Http
     */
    private $httpResponse;

    /**
     * @var \Magento\Customer\Model\Session
     */
    private $session;

    /**
     * VideoBlock constructor.
     * @param \Magento\Customer\Model\Session $session
     * @param Context $context
     * @param \Sparsh\VideoGallery\Model\VideoFactory $videoFactory
     * @param \Magento\Store\Model\StoreManagerInterface $storeManager
     * @param \Magento\Framework\App\Response\RedirectInterface $redirect
     * @param \Magento\Framework\App\Response\Http $httpResponse
     * @param \Magento\Framework\App\RequestInterface $request
     * @param \Sparsh\VideoGallery\Helper\Data $helper
     * @param array $data
     */
    public function __construct(
        \Magento\Customer\Model\Session $session,
        Context $context,
        \Sparsh\VideoGallery\Model\VideoFactory $videoFactory,
        \Magento\Store\Model\StoreManagerInterface $storeManager,
        \Magento\Framework\App\Response\RedirectInterface $redirect,
        \Magento\Framework\App\Response\Http $httpResponse,
        \Magento\Framework\App\RequestInterface $request,
        \Sparsh\VideoGallery\Helper\Data $helper,
        array $data = []
    ) {
        $this->_videoFactory = $videoFactory;
        $this->storeManager = $storeManager;
        $this->redirect = $redirect;
        $this->httpResponse = $httpResponse;
        $this->request = $request;
        $this->_helper = $helper;
        $this->session = $session;
        parent::__construct($context, $data);
    }

    /**
     * Return collection list
     *
     * @return Collection
     */
    public function getVideoCollection()
    {
        return $this->_videoFactory->create()->getCollection()
            ->addFieldToFilter('is_active', 1)
            ->addStoreFilter($this->storeManager->getStore()->getId())
            ->addCustomerGroups($this->session->getCustomerGroupId())
            ->setOrder('position', 'ASC')
            ->setOrder('updated_at', 'DESC');
    }

    /**
     * Return collection By Id
     *
     * @param Int $Id Id
     *
     * @return CollectionId
     */
    public function getVideoDetails()
    {
        $id = $this->request->getParam('Id');

        if($id){
            $videoInfo = $this->_videoFactory->create()->load($id);

            if(!empty($videoInfo)){
                if(in_array($this->storeManager->getStore()->getId(), $videoInfo->getStores()) || in_array('0', $videoInfo->getStores())){
                    if(in_array($this->session->getCustomerGroupId(), $videoInfo->getCustomerGroups()) || in_array('all', $videoInfo->getCustomerGroups())) {
                        return $videoInfo->getData();
                    }
                }
            }
        }

        $this->httpResponse->setRedirect($this->storeManager->getStore()->getBaseUrl());
    }

    /**
     * Get Media URl
     *
     * @return Mediaurl
     */
    public function getMediaUrl()
    {
        return $this->storeManager
            ->getStore()
            ->getBaseUrl(\Magento\Framework\UrlInterface::URL_TYPE_MEDIA).'sparsh/video_gallery/';
    }

    /**
     * Get Base URl
     *
     * @return Baseurl
     */
    public function getBaseUrl()
    {
        return $this->storeManager->getStore()->getBaseUrl();
    }

    /**
     * @return string
     */
    public function getRefer()
    {
        $redirectUrl = $this->redirect->getRedirectUrl();
        return $redirectUrl;
    }

    public function getTitle()
    {
        return $this->_helper->getTitle();
    }
}
