<?php
namespace Godogi\YoutubeVideoPopUp\Controller\Adminhtml\Index;

class Sample extends \Magento\Backend\App\Action
{
    public function __construct(
        \Magento\Framework\Controller\Result\RawFactory $resultRawFactory,
        \Magento\Framework\App\Response\Http\FileFactory $fileFactory,
        \Magento\Backend\App\Action\Context $context
    ) {
        $this->resultRawFactory      = $resultRawFactory;
        $this->fileFactory           = $fileFactory;
        parent::__construct($context);
    }
    public function execute()
    {
        return $this->fileFactory->create(
            'products.csv',
            'sku,video_1,video_2,video_3,video_4,video_5,video_6,video_7,video_8,video_9,video_10
24-MB01,https://www.youtube.com/embed/tgbNymZ7vqY,https://www.youtube.com/embed/dytyIBCB50g,,,,,,,,
24-MB04,https://www.youtube.com/embed/tgbNymZ7vqY,https://www.youtube.com/embed/dytyIBCB50g,,,,,,,,
24-MB03,https://www.youtube.com/embed/tgbNymZ7vqY,,,,,,,,,,',
            \Magento\Framework\App\Filesystem\DirectoryList::MEDIA,
            'application/octet-stream',
            null
        );
    }
}
