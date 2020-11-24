if (doc.total_expenses is not None) and doc.total_expenses > 0:
    if (doc.expense_account is None) or (doc.payable_account == ''):
        frappe.throw("Expense account is mandatory if expense expenses are greater than 0");
    if (doc.payable_account is None) or (doc.payable_account == ''):
        frappe.throw("Credit account is mandatory if expense expenses are greater than 0");
    if (doc.sales_partner is None) or (doc.sales_partner == ''):
        frappe.throw("Sales Partner is mandatory if expense expenses are greater than 0");
    doc.commission_rate = (doc.total_expenses / doc.total) * 100;
    doc.total_commission = doc.total_expenses * doc.conversion_rate;
    
    #frappe.throw("Saved: "+str(doc.total_expenses)+" | "+str(doc.expense_account)+" | "+str(doc.payable_account))

#frappe.throw("Not Saved: "+str(doc.total_expenses)+" | "+str(doc.expense_account)+" | "+str(doc.payable_account))