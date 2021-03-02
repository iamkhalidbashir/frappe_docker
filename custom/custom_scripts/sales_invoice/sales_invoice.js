// Journal Entry
    // New Variables
        // 30.n Sales Invoice Reference: Link
            // Default: 
            // Options: Sales Invoice
            // Depends On: eval:doc.sale_invoice_reference!=null
            // Read only: True


// Sales Invoice
    // New variables
        // Project: Mandatory
        // Expense Account: Link
            // Default: 52021 - Upwork Commissions - AMX
            // Options: Account
            // Depends On: eval:doc.debit_to != null
            // Print Hide: True
        // Payable Account: Link
            // Default: 2131 - Upwork Commission Payable - AMX
            // Options: Account
            // Depends On: 
            // Print Hide: True
        // Total expenses: Currency
            // Default: 
            // Options: currency
            // Depends On: eval:(doc.debit_to != null && doc.expense_account != null && doc.payable_account != null)
            // Print Hide: True
        // Expense Journal Entry: Data
            // Default: 
            // Options:
            // Depends On: eval:doc.expense_journal_entry!=null
            // Allow On Submit: True
            // Read only: True
            // Print Hide: True
            // Translatable: False

function c_get_je(frm){
    const je = {};
    const doc = frm.doc;
    if(doc.total_expenses && doc.total_expenses > 0){
        const accounts = [
            {
                "doctype": "Journal Entry Account",
                "account": doc.payable_account,
                "party": doc.sales_partner,
                "party_type": "Supplier",
                "debit": 0,
                "credit": doc.total_expenses * doc.conversion_rate,
                "credit_in_account_currency": doc.total_expenses,
                "user_remark": "Sale Invoice ("+doc.name+") Expense Payable Entry"
            },
            {
                "doctype": "Journal Entry Account",
                "account": doc.expense_account,
                "party": doc.sales_partner,
                "party_type": "Supplier",
                "debit": doc.total_expenses * doc.conversion_rate,
                "credit": 0,
                "debit_in_account_currency": doc.total_expenses,
                "user_remark": "Sale Invoice ("+doc.name+") Expense Payable Entry"
            }
        ];
        je.doctype = "Journal Entry";
        je.posting_date = frappe.datetime.add_days(doc.posting_date, 0);
        je.multi_currency = 1;
        je.accounts = accounts;
        je.project = doc.project;
        je.sales_invoice_reference = doc.name;
        je.title = "SV: " + doc.sales_partner + " Expenses Payable for " + doc.project;
        return je;
    }
    return null
}

function c_submit_je(frm) {
    const je = c_get_je(frm);
    if(je)
        frappe.db.insert(je)
            .then(function (doc) {
                frappe.call({
                    "method": "frappe.client.submit",
                    "args": {
                        "doc": doc
                    },
                    "callback": (r) => {
                        frappe.call({
                            "method": "frappe.client.set_value",
                            "args": {
                                "doctype": "Sales Invoice",
                                "name": frm.doc.name,
                                "fieldname": "expense_journal_entry",
                                "value": doc.name
                            }
                        });
                        frm.set_value('expense_journal_entry', doc.name);
                    }
                });
            });
}

function c_cancel_je(frm) {
    const je = frm.doc.expense_journal_entry;
    if(je)
        frappe.call({
            "method": "frappe.client.cancel",
            "args": {
                "doctype": "Journal Entry",
                "name": je
            },
            "callback": (r) => {
            }
        });
}

frappe.ui.form.on('Sales Invoice', {
    debit_to: async function(frm){
        const d_to_response = await frappe.db.get_value('Account', frm.doc.debit_to, 'account_currency');
        const debit_to_currency = d_to_response.message.account_currency ? d_to_response.message.account_currency : frm.doc.currency;

        frm.set_currency_labels(['total_expenses'], debit_to_currency)
        frm.meta.new_debit_to_currency = debit_to_currency;
    },
    total_expenses: function(frm) {
        const doc = frm.doc;
        if(doc.total_expenses && doc.total_expenses > 0 && doc.total > 0){
            const commission_rate = (doc.total_expenses / doc.total) * 100;
            const total_commission = doc.total_expenses * doc.conversion_rate;
            frm.set_value('commission_rate', commission_rate);
            frm.set_value('total_commission', total_commission);
        }
    },
    refresh: async function(frm) {
        const d_to_response = await frappe.db.get_value('Account', frm.doc.debit_to, 'account_currency');
        const default_debit_to_currency = d_to_response.message.account_currency ? d_to_response.message.account_currency : frm.doc.currency;
        const debit_to_currency = frm.meta.new_debit_to_currency ? frm.meta.new_debit_to_currency : default_debit_to_currency;

        frm.set_currency_labels(['total_expenses'], debit_to_currency)
        frm.set_query("expense_account", function(doc, cdt, cdn) {
            const debit_to_currency = frm.meta.new_debit_to_currency ? frm.meta.new_debit_to_currency : default_debit_to_currency;
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
            const debit_to_currency = frm.meta.new_debit_to_currency ? frm.meta.new_debit_to_currency : default_debit_to_currency;
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
    },
    after_cancel: async function(frm){
        // await c_cancel_je(frm);
    }
});