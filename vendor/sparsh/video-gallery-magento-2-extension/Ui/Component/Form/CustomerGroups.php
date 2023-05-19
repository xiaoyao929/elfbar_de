<?php

namespace Sparsh\VideoGallery\Ui\Component\Form;

use Magento\Customer\Api\GroupRepositoryInterface;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\Convert\DataObject;
use Magento\Framework\Option\ArrayInterface;

class CustomerGroups implements ArrayInterface
{
    /**
     * @var GroupRepositoryInterface
     */
    private $groupRepository;
    /**
     * @var SearchCriteriaBuilder
     */
    private $searchCriteriaBuilder;
    /**
     * @var DataObject
     */
    private $objectConverter;

    /**
     * CustomerGroups constructor.
     * @param GroupRepositoryInterface $groupRepository
     * @param SearchCriteriaBuilder $searchCriteriaBuilder
     * @param DataObject $objectConverter
     */
    public function __construct(
        GroupRepositoryInterface $groupRepository,
        SearchCriteriaBuilder $searchCriteriaBuilder,
        DataObject $objectConverter
    )
    {
        $this->groupRepository = $groupRepository;
        $this->searchCriteriaBuilder = $searchCriteriaBuilder;
        $this->objectConverter = $objectConverter;
    }

    public function toOptionArray()
    {
        $options [] = ["label" => "All", "value" => "all"];
        $customerGroups = $this->groupRepository->getList($this->searchCriteriaBuilder->create())->getItems();
        return array_merge($options, $this->objectConverter->toOptionArray($customerGroups, 'id', 'code'));
    }
}
