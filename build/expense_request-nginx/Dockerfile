FROM bitnami/node:12-prod

COPY build/expense_request-nginx/install_app.sh /install_app

RUN /install_app expense_request https://github.com/the-bantoo/expense_request main

FROM frappe/erpnext-nginx:edge

COPY --from=0 /home/frappe/frappe-bench/sites/ /var/www/html/
COPY --from=0 /rsync /rsync
RUN echo -n "\nexpense_request" >> /var/www/html/apps.txt

VOLUME [ "/assets" ]

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]