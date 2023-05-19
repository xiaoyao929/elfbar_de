<?php
/**
 * Class Reindex
 *
 * PHP version 7
 *
 * @category Sparsh
 * @package  Sparsh_ReindexFromAdmin
 * @author   Sparsh <magento@sparsh-technologies.com>
 * @license  https://www.sparsh-technologies.com  Open Software License (OSL 3.0)
 * @link     https://www.sparsh-technologies.com
 */
namespace Sparsh\ReindexFromAdmin\Controller\Adminhtml\Reindex;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\Indexer\IndexerRegistry;

/**
 * Class Reindex
 *
 * PHP version 7
 *
 * @category Sparsh
 * @package  Sparsh_ReindexFromAdmin
 * @author   Sparsh <magento@sparsh-technologies.com>
 * @license  https://www.sparsh-technologies.com  Open Software License (OSL 3.0)
 * @link     https://www.sparsh-technologies.com
 */
class Reindex extends Action
{

    /**
     * @var \Magento\Framework\Indexer\IndexerRegistry
     */
    protected $_indexerRegistry;

    /**
     * Reindex constructor.
     *
     * @param Context $context
     * @param IndexerRegistry $indexerRegistry

     */

    public function __construct(
        Context $context,
        IndexerRegistry $indexerRegistry
    ) {
        $this->_indexerRegistry = $indexerRegistry;
        parent::__construct($context);
    }

    /**
     *  Authorization Of Reindex
     *
     * @return boolean
     */
    protected function _isAllowed()
    {
        return $this->_authorization->isAllowed('Sparsh_ReindexFromAdmin::reindex');
    }
    /**
     * Reindex action
     *
     * @return \Magento\Framework\Controller\ResultInterface
     */


    public function execute()
    {
        $indexerIds = $this->getRequest()->getParam('indexer_ids');
        if (!is_array($indexerIds)) {
            $this->messageManager->addError(__('An item needs to be selected. Select and try again.'));
        } else {
            try {
                foreach ($indexerIds as $indexerId) {
                    $indexer = $this->_indexerRegistry->get($indexerId);
                    $indexer->reindexAll();
                }
                $this->messageManager->addSuccess(
                    __('%1 indexer(s) were reindexed.', count($indexerIds))
                );
            } catch (\Exception $e) {
                $this->messageManager->addException(
                    $e,
                    __("We couldn't reindex indexer(s)' because of an error.")
                );
            }
        }
        $this->_redirect('indexer/indexer/list');
    }
}
