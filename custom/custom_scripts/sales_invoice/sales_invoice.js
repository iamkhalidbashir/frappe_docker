// New variables
// Project: Mandatory
// Expense Account: Link
    // Default: 5222 - Upwork Fees - USD - AMX
    // Options: Account
    // Depends On: eval:doc.debit_to != null
// Payable Account: Link
    // Default: 
    // Options: 
    // Depends On: 
// ExpenseAccount: Link
    // Default: 2131 - Upwork Fees Payable - USD - AMX
    // Options: Account
    // Depends On: 
// Total expenses: Currency
    // Default: 
    // Options: Company:company:default_currency
    // Depends On: eval:(doc.debit_to != null && doc.expense_account != null && doc.payable_account != null)
// Expense Journal Entry: Link
    // Default: 
    // Options: Journal Entry
    // Depends On: eval:doc.expense_journal_entry!=''

function c_get_je(frm){
    const je = {};
    const doc = frm.doc;
    const debit_to_currency = frm.meta.debit_to_currency ? frm.meta.debit_to_currency : doc.currency;
    
    const accounts = [
        {
            "doctype": "Journal Entry Account",
            "account": doc.payable_account,
            "party": doc.sales_partner,
            "party_type": "Supplier",
            "debit": 0,
            "credit": doc.total_expenses * doc.conversion_rate,
            "credit_in_account_currency": doc.total_expenses,
            "user_remark": "Sale Invoice ("+doc.name+") Expense Entry"
        },
        {
            "doctype": "Journal Entry Account",
            "account": doc.expense_account,
            "party": doc.sales_partner,
            "party_type": "Supplier",
            "debit": doc.total_expenses * doc.conversion_rate,
            "credit": 0,
            "debit_in_account_currency": doc.total_expenses,
            "user_remark": "Sale Invoice ("+doc.name+") Expense Entry"
        }
    ];
    je.doctype = "Journal Entry";
    je.posting_date = frappe.datetime.add_days(frm.doc.process_date, 0);
    je.multi_currency = 1;
    je.accounts = accounts;
    je.project = doc.project;
    je.title = "SV: " + doc.sales_partner + " Expenses for " + doc.project;
    return je;
}

function c_submit_je(frm) {
    const je = c_get_je(frm);
    frappe.db.insert(je)
        .then(function (doc) {
            console.log("frappe.db.insert", doc);
            frappe.call({
                "method": "frappe.client.submit",
                "args": {
                    "doc": doc
                },
                "callback": (r) => {
                    console.log("callback", r);
                    frm.set_value('expense_journal_entry', doc.name)
                }
            });
        });
}

frappe.ui.form.on('Sales Invoice', {
    debit_to: async function(frm){
        const debit_to_currency = await frappe.db.get_value('Account', frm.doc.debit_to, 'account_currency');
        frm.meta.debit_to_currency = debit_to_currency.message.account_currency;
    },
    total_expenses: function(frm) {
        const doc = frm.doc;
        console.log("total_expenses doc: ", doc)
        if(doc.total_expenses && doc.total_expenses > 0){
            console.log("we here ")
            const commission_rate = (doc.total_expenses / doc.total) * 100;
            const total_commission = doc.total_expenses * doc.conversion_rate;
            frm.set_value('commission_rate', commission_rate);
            frm.set_value('total_commission', total_commission);
        }
    },
	setup: function(frm) {
		frm.set_query("expense_account", function(doc, cdt, cdn) {
		    const debit_to_currency = frm.meta.debit_to_currency ? frm.meta.debit_to_currency : doc.currency;
			return {
        		filters: [
        			['Account', 'account_type', '=', 'Expense Account'],
        			['Account', 'root_type', '=', 'Expense'],
        			['Account', 'account_currency', '=', debit_to_currency],
        			['Account', 'is_group', '=', 0],
        			['Account', 'company', '=', doc.company]
        		]
        	};
		});
		
		frm.set_query("payable_account", function(doc, cdt, cdn) {
		    const debit_to_currency = frm.meta.debit_to_currency ? frm.meta.debit_to_currency : doc.currency;
			return {
        		filters: [
        			['Account', 'account_type', '=', 'Payable'],
        			['Account', 'root_type', '=', 'Liability'],
        			['Account', 'account_currency', '=', debit_to_currency],
        			['Account', 'is_group', '=', 0],
        			['Account', 'company', '=', doc.company]
        		]
        	};
		});
	},
	on_submit: async function(frm){
	    await c_submit_je(frm);
	}
});