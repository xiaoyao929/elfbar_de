<?php
namespace Godogi\YoutubeVideoPopUp\Block;

use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Catalog\Model\Category;

class YoutubePopUp extends \Magento\Catalog\Block\Product\View
{
  /**
   * @param Context $context
   * @param \Magento\Framework\Url\EncoderInterface $urlEncoder
   * @param \Magento\Framework\Json\EncoderInterface $jsonEncoder
   * @param \Magento\Framework\Stdlib\StringUtils $string
   * @param \Magento\Catalog\Helper\Product $productHelper
   * @param \Magento\Catalog\Model\ProductTypes\ConfigInterface $productTypeConfig
   * @param \Magento\Framework\Locale\FormatInterface $localeFormat
   * @param \Magento\Customer\Model\Session $customerSession
   * @param ProductRepositoryInterface|\Magento\Framework\Pricing\PriceCurrencyInterface $productRepository
   * @param \Magento\Framework\Pricing\PriceCurrencyInterface $priceCurrency
   * @param array $data
   * @codingStandardsIgnoreStart
   * @SuppressWarnings(PHPMD.ExcessiveParameterList)
   */
  public function __construct(
      \Magento\Catalog\Block\Product\Context $context,
      \Magento\Framework\Url\EncoderInterface $urlEncoder,
      \Magento\Framework\Json\EncoderInterface $jsonEncoder,
      \Magento\Framework\Stdlib\StringUtils $string,
      \Magento\Catalog\Helper\Product $productHelper,
      \Magento\Catalog\Model\ProductTypes\ConfigInterface $productTypeConfig,
      \Magento\Framework\Locale\FormatInterface $localeFormat,
      \Magento\Customer\Model\Session $customerSession,
      ProductRepositoryInterface $productRepository,
      \Magento\Framework\Pricing\PriceCurrencyInterface $priceCurrency,
      array $data = []
  ) {
    parent::__construct(
          $context,
          $urlEncoder,
          $jsonEncoder,
          $string,
          $productHelper,
          $productTypeConfig,
          $localeFormat,
          $customerSession,
          $productRepository,
          $priceCurrency,
          $data
      );
  }

  public function getProductName()
  {
    return $this->getProduct()->getName();
  }

  public function getYoutubeVideos()
  {
      $youtubeVideos = [];
      $videoUrls = $this->getProduct()->getCustomAttribute('video_1');
      if (null !== $videoUrls) {
          $videoUrls = explode(',',$videoUrls->getValue());

          foreach($videoUrls as $videoUrl){
              if (strpos($videoUrl, 'https://www.youtube.com/embed/') !== false) {
                  $youtubeVideos[] = $videoUrl;
              }else{
                  if (strpos($videoUrl, 'https://www.youtube.com/watch?v=') !== false) {
                      $videoUrl = str_replace('https://www.youtube.com/watch?v=', '', $videoUrl);
                  }
                  if (strpos($videoUrl, 'https://youtu.be/') !== false) {
                      $videoUrl = str_replace('https://youtu.be/', '', $videoUrl);
                  }
                  $videoUrl = 'https://www.youtube.com/embed/' . $videoUrl;
                  $youtubeVideos[] = $videoUrl;
              }
          }
      }
      return $youtubeVideos;
  }
  public function getPdfLinks(){
    $pdfLinks = [];
    $pdfLinksAttr = $this->getProduct()->getCustomAttribute('instructions_pdf');
    if (null !== $pdfLinksAttr) {
        $pdfLinks = explode(',',$pdfLinksAttr->getValue());
    }
    return $pdfLinks;
  }
}
