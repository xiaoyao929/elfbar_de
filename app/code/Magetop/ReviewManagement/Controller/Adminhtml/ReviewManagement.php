<?php
/**
 * @Author      Magetop Team
 * @package     Review Management
 * @copyright   Copyright (c) 2019 MAGETOP (http://www.magetop.com)
 * @terms       http://www.magetop.com/terms
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 **/
 
namespace Magetop\ReviewManagement\Controller\Adminhtml;

class ReviewManagement extends Actions
{
	/**
	 * Form session key
	 * @var string
	 */
    protected $_formSessionKey  = 'magetop_reviewmanagement_form_data';

    /**
     * Allowed Key
     * @var string
     */
    protected $_allowedKey      = 'Magetop_ReviewManagement::reviewmanagement';

    /**
     * Model class name
     * @var string
     */
    protected $_modelClass      = 'Magetop\ReviewManagement\Model\ReviewManagement';

    /**
     * Active menu key
     * @var string
     */
    protected $_activeMenu      = 'Magetop_ReviewManagement::reviewmanagement';

    /**
     * Status field name
     * @var string
     */
    protected $_statusField     = 'status';
}