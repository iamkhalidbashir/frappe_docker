// Journal Entry
    // New Variables
        // 31.n Payment Entry Reference: Link
            // Default: 
            // Options: Payment Entry
            // Depends On: eval:doc.payment_entry_reference!=null
            // Read only: True

// Payment Entry
    // New Variables
        // 18.o Accounts: Section break | Collapsible: 0
        // 35.n Column Break
        // 36.n Pay Expenses: Currency
            // Default: 
            // Options: currency
            // Depends On: eval:doc.pay_expenses > 0
        // 37.n Load Sales Invoice Exchange Rate: Button

async function c_get_je(frm){
    const je = {};
    const doc = frm.doc;
    const {si} = await get_si_doc(frm);
    if(!si || !si.total_expenses || si.total_expenses == 0 || doc.pay_expenses == 0)
        return null

    const accounts = [
        {
            "doctype": "Journal Entry Account",
            "account": si.payable_account,
            "party": si.sales_partner,
            "party_type": "Supplier",
            "debit": doc.pay_expenses * si.conversion_rate,
            "credit": 0,
            "debit_in_account_currency": doc.pay_expenses,
            "user_remark": "Sale Invoice ("+doc.name+") Expense Payment Entry"
        },
        {
            "doctype": "Journal Entry Account",
            "account": doc.paid_to,
            "party": si.sales_partner,
            "party_type": "Supplier",
            "debit": 0,
            "credit": doc.pay_expenses * si.conversion_rate,
            "credit_in_account_currency": doc.pay_expenses,
            "user_remark": "Sale Invoice ("+doc.name+") Expense Payment Entry"
        }
    ];
    je.doctype = "Journal Entry";
    je.posting_date = frappe.datetime.add_days(doc.posting_date, 0);
    je.multi_currency = 1;
    je.accounts = accounts;
    je.project = si.project;
    je.sales_invoice_reference = si.name;
    je.payment_entry_reference = doc.name;
    je.title = "PE: " + si.sales_partner + " Expenses Paid for " + doc.project;
    return je;
}

async function c_submit_je(frm) {
    const je = await c_get_je(frm);
    if(!je)
        return;
    frappe.db.insert(je)
        .then(function (doc) {
            frappe.call({
                "method": "frappe.client.submit",
                "args": {
                    "doc": doc
                },
                "callback": (r) => {
                }
            });
        });
}

async function get_si_doc(frm){
    const doc = frm.doc;
    if(doc.references && doc.references.length > 0 && doc.references[0].reference_doctype === 'Sales Invoice'){
        const si_ref = doc.references[0]
        if(si_ref){
            if(frm.si && frm.si.name === si_ref.reference_name){
                return {si: frm.si, si_ref}
            }

            const si = await frappe.db.get_doc('Sales Invoice', si_ref.reference_name);
            frm.si = si;
            return {si, si_ref}
        }
    }
    return {}
}

async function get_je_pe_list(frm){
    const {si} = await get_si_doc(frm);
    if(frm.je_pe_list && si.name === frm.je_pe_list.si_name){
        return frm.je_pe_list
    }
    const result = await frappe.call({ method:"frappe.client.get_list",
        args:{
            doctype: "Journal Entry",
            fields: ["total_amount"],
            filters:[
                ["sales_invoice_reference","=", si.name],
                ["payment_entry_reference","!=",''],
            ]
        }
    });
    return result ? {...result, si_name: si.name} : {}
}

async function get_total_paid_expenses(frm){
    const result = await get_je_pe_list(frm);
    if(result && result.message){
        if(result.message.length > 0){
            var total_paid_expenses = 0
            result.message.forEach(je => {
                total_paid_expenses += je.total_amount/2;
            });
            return total_paid_expenses 
        }else{
            return 0
        }
    }else{
        return null
    }
}

async function set_to_pay_expenses(frm){
    const doc = frm.doc;
    const {si, si_ref} = await get_si_doc(frm);
    if(!si)
        return
    const total_paid_expenses = await get_total_paid_expenses(frm);
    const total_paid_remaining_expenses = si.total_expenses - total_paid_expenses;
    if(si && si.total_expenses > 0){
        var to_pay_expenses = si.total_expenses * (doc.paid_amount/si_ref.total_amount)
        if(total_paid_remaining_expenses < to_pay_expenses)
            to_pay_expenses = total_paid_remaining_expenses
        frm.set_value('pay_expenses', to_pay_expenses);
        frm.set_currency_labels(['pay_expenses'], doc.paid_to_account_currency)
    }
}

async function validate_expenses(frm){
    const doc = frm.doc
    const {si, si_ref} = await get_si_doc(frm);
    if(!si)
        return
    const total_paid_expenses = await get_total_paid_expenses(frm);
    const total_paid_remaining_expenses = si.total_expenses - total_paid_expenses;
    if(total_paid_remaining_expenses < doc.pay_expenses){
        frappe.throw(__("Pay Expenses must be less than or equal to "+doc.paid_to_account_currency+" "+total_paid_remaining_expenses));
    }
    if(si_ref.outstanding_amount === doc.paid_amount && total_paid_remaining_expenses !== doc.pay_expenses){
        frappe.throw(__("Pay Expenses must be equal to "+doc.paid_to_account_currency+" "+total_paid_remaining_expenses));
    }
}

frappe.ui.form.on('Payment Entry', {
    paid_amount: async function(frm){
        await set_to_pay_expenses(frm);
    },
    refresh: async function(frm) {
        const doc = frm.doc
        const {si} = await get_si_doc(frm);
        if(si){
            if(!doc.project)
                frm.set_value('project', si.project);
            if(!doc.pay_expenses)
                await set_to_pay_expenses(frm);
        }

        frm.cscript.load_sales_invoice_exchange_rate = async function() {
            const {si} = await get_si_doc(frm);
            if(si){
                frm.set_value('target_exchange_rate', si.conversion_rate);
                frm.set_value('source_exchange_rate', si.conversion_rate);
            }else{
                frappe.throw(__("No Sales Invoice found in references"));
            }
        }
    },
    validate: async function(frm){
        await validate_expenses(frm)
    },
    on_submit: async function(frm){
        await c_submit_je(frm);
    }
});